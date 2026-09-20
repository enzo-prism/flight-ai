-- Empty/redacted/future-only records are skipped, not counted as reviewed.
alter table public.product_runs add column skipped_count integer not null default 0 check(skipped_count>=0);

-- Reopening requires genuinely new source evidence. A different ordering or quote
-- selection from the same already-reviewed messages never reopens a closed item.
create or replace function public.product_save_analysis(p_workspace uuid,p_owner uuid,p_connection uuid,p_lease text,p_source jsonb,p_analysis jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare
 saved_conversation_id uuid;
 f jsonb;
 w product_workspaces;
 previous_messages jsonb;
 prior_finding product_findings;
 recurrence boolean;
 recurrence_event jsonb;
begin
 select * into w from product_workspaces where id=p_workspace and owner_id=p_owner for update;
 if not found or w.scan_lease is distinct from p_lease or w.scan_lock_until<=now() then raise exception 'Scan lease expired'; end if;
 if not exists(select 1 from product_connections where id=p_connection and workspace_id=p_workspace and status='authorized') then raise exception 'Connection unavailable'; end if;
 -- Defensive guard: even an internal caller cannot replace real prior analysis
 -- with the empty result of a skipped evaluation.
 if p_analysis->>'skipped'='true' then return null; end if;
 select messages into previous_messages from product_conversations
 where workspace_id=p_workspace and connection_id=p_connection and external_id=p_source->>'externalId';
 previous_messages=coalesce(previous_messages,'[]'::jsonb);
 insert into product_conversations(workspace_id,connection_id,external_id,subject,customer,messages,source_url,analysis_coverage,reviewed_at)
 values(p_workspace,p_connection,p_source->>'externalId',p_source->>'subject',p_source->'customer',p_source->'messages',p_source->>'sourceUrl',coalesce(p_analysis->'coverage','{}'),now())
 on conflict(connection_id,external_id) do update set subject=excluded.subject,customer=excluded.customer,messages=excluded.messages,source_url=excluded.source_url,analysis_coverage=excluded.analysis_coverage,reviewed_at=now()
 returning id into saved_conversation_id;
 update product_findings set analysis_current=false where workspace_id=p_workspace and product_findings.conversation_id=saved_conversation_id;
 for f in select * from jsonb_array_elements(p_analysis->'findings') loop
  select * into prior_finding from product_findings where workspace_id=p_workspace and conversation_id=saved_conversation_id and type=f->>'type' for update;
  recurrence=false;
  if found and prior_finding.status in ('handled','dismissed') then
   select exists(
    select 1 from jsonb_array_elements(f->'evidence') incoming
    where not exists(
     select 1 from jsonb_array_elements(prior_finding.evidence) old_evidence
     where old_evidence->>'messageId'=incoming->>'messageId' and old_evidence->>'quote'=incoming->>'quote'
    ) and exists(
     select 1 from jsonb_array_elements(p_source->'messages') new_message
     where new_message->>'id'=incoming->>'messageId' and not exists(
      select 1 from jsonb_array_elements(previous_messages) old_message
      where old_message->>'id'=new_message->>'id' and old_message->>'text'=new_message->>'text'
     )
    )
   ) into recurrence;
  end if;
  recurrence_event=jsonb_build_object('at',now(),'actor','system','action','reopened_new_evidence','previous_status',prior_finding.status,'previous_outcome',prior_finding.outcome,'previous_dismiss_reason',prior_finding.dismiss_reason,'previous_evidence',prior_finding.evidence,'new_evidence',f->'evidence');
  insert into product_findings(workspace_id,conversation_id,type,title,summary,reason,priority,waiting_since,due_at,evidence,suggestion,draft,analysis_current,last_observed_at)
  values(p_workspace,saved_conversation_id,f->>'type',f->>'title',f->>'summary',f->>'reason',case when recurrence then 'review' else f->>'priority' end,(f->>'waitingSince')::timestamptz,(f->>'dueAt')::timestamptz,f->'evidence',f->>'suggestion',coalesce(f->>'draft',''),true,now())
  on conflict(conversation_id,type) do update set
   title=excluded.title,summary=excluded.summary,reason=excluded.reason,priority=excluded.priority,
   waiting_since=excluded.waiting_since,due_at=excluded.due_at,evidence=excluded.evidence,suggestion=excluded.suggestion,
   status=case when recurrence then 'open' else product_findings.status end,
   activity=case when recurrence then product_findings.activity || jsonb_build_array(recurrence_event) else product_findings.activity end,
   analysis_current=true,last_observed_at=now();
 end loop;
 return saved_conversation_id;
end;
$$;
revoke all on function public.product_save_analysis(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.product_save_analysis(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;
