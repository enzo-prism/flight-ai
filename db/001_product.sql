-- Private connector credentials never receive authenticated/anon grants.
create table if not exists public.product_workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null default 'My workspace', lens text check(lens in ('sales','support')), created_at timestamptz not null default now(), scan_lock_until timestamptz, scan_lease text
);
create table if not exists public.product_connections (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.product_workspaces(id) on delete cascade,
 account_id text not null,provider text not null check(provider in ('gmail','microsoft','hubspot','zendesk','intercom')),label text not null,status text not null default 'authorized' check(status in ('authorized','disconnected','error')),
 config jsonb not null default '{}',cursor text,has_more boolean not null default true,last_synced_at timestamptz,created_at timestamptz not null default now(), unique(workspace_id,provider)
);
create table if not exists public.product_connector_secrets (connection_id uuid primary key references public.product_connections(id) on delete cascade, encrypted text not null);
create table if not exists public.product_oauth_states (state_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,workspace_id uuid not null references public.product_workspaces(id) on delete cascade,provider text not null,config jsonb not null,verifier_encrypted text not null,expires_at timestamptz not null);
create table if not exists public.product_conversations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.product_workspaces(id) on delete cascade,connection_id uuid not null references public.product_connections(id) on delete cascade,external_id text not null,subject text not null,customer jsonb not null,messages jsonb not null,source_url text,analysis_coverage jsonb not null default '{}',reviewed_at timestamptz not null default now(),unique(connection_id,external_id)
);
create table if not exists public.product_findings (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.product_workspaces(id) on delete cascade,conversation_id uuid not null references public.product_conversations(id) on delete cascade,type text not null,title text not null,summary text not null,reason text not null,priority text not null check(priority in ('high','attention','review')),waiting_since timestamptz,due_at timestamptz,evidence jsonb not null,suggestion text not null,draft text not null default '',status text not null default 'open' check(status in ('open','in-progress','handled','dismissed')),owner text,outcome text,dismiss_reason text,activity jsonb not null default '[]',analysis_current boolean not null default true,last_observed_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(conversation_id,type)
);
create table if not exists public.product_runs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.product_workspaces(id) on delete cascade,connection_id uuid not null references public.product_connections(id) on delete cascade,status text not null check(status in ('running','completed','failed')),reviewed_count integer not null default 0,has_more boolean not null default true,error text,started_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.product_workspaces enable row level security;
alter table public.product_connections enable row level security;
alter table public.product_connector_secrets enable row level security;
alter table public.product_oauth_states enable row level security;
alter table public.product_conversations enable row level security;
alter table public.product_findings enable row level security;
alter table public.product_runs enable row level security;
-- Server owns mutations; authenticated clients can only read their tenant data.
revoke all on public.product_workspaces,public.product_connections,public.product_connector_secrets,public.product_oauth_states,public.product_conversations,public.product_findings,public.product_runs from anon,authenticated;
grant select on public.product_workspaces,public.product_conversations,public.product_findings,public.product_runs to authenticated;
grant select(id,workspace_id,provider,label,status,last_synced_at,has_more,created_at) on public.product_connections to authenticated;
create policy product_workspace_owner on public.product_workspaces for select to authenticated using(owner_id=auth.uid());
create policy product_connections_owner on public.product_connections for select to authenticated using(exists(select 1 from public.product_workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create policy product_conversations_owner on public.product_conversations for select to authenticated using(exists(select 1 from public.product_workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create policy product_findings_owner on public.product_findings for select to authenticated using(exists(select 1 from public.product_workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create policy product_runs_owner on public.product_runs for select to authenticated using(exists(select 1 from public.product_workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create or replace function public.product_acquire_scan(p_workspace uuid,p_owner uuid,p_lease text) returns boolean language sql security definer set search_path=public as $$
 with locked as (update product_workspaces set scan_lock_until=now()+interval '6 minutes',scan_lease=p_lease where id=p_workspace and owner_id=p_owner and (scan_lock_until is null or scan_lock_until<now()) returning id) select exists(select 1 from locked);
$$;
revoke all on function public.product_acquire_scan(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.product_acquire_scan(uuid,uuid,text) to service_role;
-- A row lock makes each action and its activity entry atomic, including concurrent tabs.
create or replace function public.product_update_finding(p_workspace uuid,p_owner uuid,p_id uuid,p_patch jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare current_row product_findings; updated_row product_findings;
begin
 if not exists(select 1 from product_workspaces where id=p_workspace and owner_id=p_owner) then return null; end if;
 select * into current_row from product_findings where id=p_id and workspace_id=p_workspace for update;
 if not found then return null; end if;
 update product_findings set
 status=case when p_patch ? 'status' then p_patch->>'status' else status end,
 owner=case when p_patch ? 'owner' then p_patch->>'owner' else owner end,
 draft=case when p_patch ? 'draft' then p_patch->>'draft' else draft end,
 outcome=case when p_patch ? 'outcome' then p_patch->>'outcome' else outcome end,
 dismiss_reason=case when p_patch ? 'dismiss_reason' then p_patch->>'dismiss_reason' else dismiss_reason end,
 activity=activity || jsonb_build_array(jsonb_build_object('at',now(),'actor',p_owner,'changes',p_patch - 'draft','draft_updated',p_patch ? 'draft'))
 where id=p_id and workspace_id=p_workspace returning * into updated_row;
 return to_jsonb(updated_row);
end;
$$;
revoke all on function public.product_update_finding(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.product_update_finding(uuid,uuid,uuid,jsonb) to service_role;

grant all on public.product_workspaces,public.product_connections,public.product_connector_secrets,public.product_oauth_states,public.product_conversations,public.product_findings,public.product_runs to service_role;
-- Connector metadata and encrypted credentials commit together. A workspace row
-- lock serializes reconnect/disconnect with lease acquisition, never with network IO.
create or replace function public.product_connect(p_workspace uuid,p_owner uuid,p_id uuid,p_provider text,p_label text,p_account text,p_config jsonb,p_encrypted text) returns boolean language plpgsql security definer set search_path=public as $$
declare w product_workspaces; c product_connections;
begin
 select * into w from product_workspaces where id=p_workspace and owner_id=p_owner for update;
 if not found or w.scan_lock_until>now() then return false; end if;
 select * into c from product_connections where workspace_id=p_workspace and provider=p_provider for update;
 if found and (c.id<>p_id or c.account_id<>p_account) then return false; end if;
 insert into product_connections(id,workspace_id,provider,label,account_id,status,config,cursor,has_more) values(p_id,p_workspace,p_provider,p_label,p_account,'authorized',p_config,null,true)
 on conflict(id) do update set label=excluded.label,status='authorized',config=excluded.config,cursor=null,has_more=true;
 insert into product_connector_secrets(connection_id,encrypted) values(p_id,p_encrypted) on conflict(connection_id) do update set encrypted=excluded.encrypted;
 return true;
end;
$$;
create or replace function public.product_disconnect(p_workspace uuid,p_owner uuid,p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare w product_workspaces;
begin
 select * into w from product_workspaces where id=p_workspace and owner_id=p_owner for update;
 if not found or w.scan_lock_until>now() then return false; end if;
 if not exists(select 1 from product_connections where id=p_id and workspace_id=p_workspace) then return false; end if;
 delete from product_connector_secrets where connection_id=p_id;
 update product_connections set status='disconnected',cursor=null where id=p_id and workspace_id=p_workspace;
 return true;
end;
$$;
revoke all on function public.product_connect(uuid,uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.product_disconnect(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.product_connect(uuid,uuid,uuid,text,text,text,jsonb,text) to service_role;
grant execute on function public.product_disconnect(uuid,uuid,uuid) to service_role;

create or replace function public.product_update_workspace(p_workspace uuid,p_owner uuid,p_patch jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w product_workspaces;
begin
 select * into w from product_workspaces where id=p_workspace and owner_id=p_owner for update;
 if not found then return null; end if;
 if p_patch ? 'lens' and w.lens is distinct from (p_patch->>'lens') and
 (w.scan_lock_until>now() or exists(select 1 from product_runs where workspace_id=p_workspace)) then return null; end if;
 update product_workspaces set name=coalesce(p_patch->>'name',name),lens=coalesce(p_patch->>'lens',lens)
 where id=p_workspace returning * into w;
 return jsonb_build_object('id',w.id,'name',w.name,'lens',w.lens);
end;
$$;
-- Publish all findings for one analyzed conversation in one transaction. If any
-- insert fails, previous evidence and current flags remain intact.
create or replace function public.product_save_analysis(p_workspace uuid,p_owner uuid,p_connection uuid,p_lease text,p_source jsonb,p_analysis jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_conversation_id uuid; f jsonb; w product_workspaces;
begin
 select * into w from product_workspaces where id=p_workspace and owner_id=p_owner for update;
 if not found or w.scan_lease is distinct from p_lease or w.scan_lock_until<=now() then raise exception 'Scan lease expired'; end if;
 if not exists(select 1 from product_connections where id=p_connection and workspace_id=p_workspace and status='authorized') then raise exception 'Connection unavailable'; end if;
 insert into product_conversations(workspace_id,connection_id,external_id,subject,customer,messages,source_url,analysis_coverage,reviewed_at)
 values(p_workspace,p_connection,p_source->>'externalId',p_source->>'subject',p_source->'customer',p_source->'messages',p_source->>'sourceUrl',coalesce(p_analysis->'coverage','{}'),now())
 on conflict(connection_id,external_id) do update set subject=excluded.subject,customer=excluded.customer,messages=excluded.messages,source_url=excluded.source_url,analysis_coverage=excluded.analysis_coverage,reviewed_at=now()
 returning id into saved_conversation_id;
 update product_findings set analysis_current=false where workspace_id=p_workspace and product_findings.conversation_id=saved_conversation_id;
 for f in select * from jsonb_array_elements(p_analysis->'findings') loop
  insert into product_findings(workspace_id,conversation_id,type,title,summary,reason,priority,waiting_since,due_at,evidence,suggestion,draft,analysis_current,last_observed_at)
  values(p_workspace,saved_conversation_id,f->>'type',f->>'title',f->>'summary',f->>'reason',f->>'priority',(f->>'waitingSince')::timestamptz,(f->>'dueAt')::timestamptz,f->'evidence',f->>'suggestion',coalesce(f->>'draft',''),true,now())
  on conflict(conversation_id,type) do update set title=excluded.title,summary=excluded.summary,reason=excluded.reason,priority=excluded.priority,waiting_since=excluded.waiting_since,due_at=excluded.due_at,evidence=excluded.evidence,suggestion=excluded.suggestion,analysis_current=true,last_observed_at=now();
 end loop;
 return saved_conversation_id;
end;
$$;
revoke all on function public.product_update_workspace(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.product_save_analysis(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.product_update_workspace(uuid,uuid,jsonb) to service_role;
grant execute on function public.product_save_analysis(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;
