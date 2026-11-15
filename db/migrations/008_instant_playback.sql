-- Two-stage publishing: a fast stream-copy WebM is playable immediately; an H.264 MP4 replaces it in the background.
alter table recordings
  add column playback_mime text not null default 'video/mp4',
  add column universal boolean not null default true;   -- true when playback_key is the H.264 MP4 every device can play
