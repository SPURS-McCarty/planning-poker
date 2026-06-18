create table if not exists pp_rooms (
  room_id varchar(12) primary key,
  session_name varchar(120) not null,
  host_participant_id varchar(64) null,
  scale_json text not null,
  revealed boolean not null default false,
  round_number integer not null default 1,
  auto_reveal boolean not null default false,
  current_issue text not null default '',
  version bigint not null default 1,
  state_json text not null,
  created_by varchar(128) not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  expires_at timestamp null
);

create table if not exists pp_room_participants (
  room_id varchar(12) not null,
  participant_id varchar(64) not null,
  client_id varchar(128) not null,
  display_name varchar(120) not null,
  role varchar(20) not null,
  has_voted boolean not null default false,
  vote varchar(20) null,
  chips integer not null default 3,
  joined_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  primary key (room_id, participant_id),
  unique (room_id, client_id),
  foreign key (room_id) references pp_rooms(room_id)
);

create table if not exists pp_room_events (
  room_id varchar(12) not null,
  version bigint not null,
  event_type varchar(40) not null,
  event_json text not null,
  created_at timestamp not null default now(),
  primary key (room_id, version),
  foreign key (room_id) references pp_rooms(room_id)
);

create index if not exists idx_pp_room_events_room_created
on pp_room_events (room_id, created_at);

create index if not exists idx_pp_room_participants_room
on pp_room_participants (room_id);
