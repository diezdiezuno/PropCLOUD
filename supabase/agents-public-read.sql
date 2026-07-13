-- El sitio web usa el cliente anónimo. Para que muestre los agentes, `users`
-- necesita una policy de lectura anónima limitada a los visibles (show_on_web).
-- (La tabla vieja `agents` tenía `for select using (is_active = true)`.)
-- Solo se exponen las filas con show_on_web = true; el resto queda oculto.

drop policy if exists "public web agents" on users;
create policy "public web agents" on users
  for select to anon, authenticated
  using (show_on_web = true);
