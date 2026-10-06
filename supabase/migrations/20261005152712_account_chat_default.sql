-- Explicit product choice: account-authorized messages, without E2EE enrollment.
-- Keep membership/session/file policies and existing ciphertext unchanged.
update private.chat_rollout set enabled=false where singleton;
