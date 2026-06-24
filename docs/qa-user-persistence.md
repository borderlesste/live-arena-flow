# QA de persistencia de usuarios

Este control verifica el recorrido real de datos en Supabase:

1. Crea y autentica un usuario temporal confirmado.
2. Actualiza nombre visible y preferencias en `public.profiles`.
3. Comprueba la asignación automática del rol `user`.
4. Sigue un partido mediante `public.user_favorite_matches`.
5. Publica un mensaje mediante `send_chat_message` y verifica `public.chat_messages`.
6. Relee datos con la sesión autenticada para validar RLS.
7. Elimina el usuario temporal y confirma el borrado en cascada.

Ejecutar:

```powershell
npm.cmd run qa:persistence
```

El script no imprime claves ni datos de usuarios reales. Falla en el primer límite que no persista y siempre intenta retirar los datos temporales.

Para cubrir también la interfaz sobre un servidor ya iniciado:

```powershell
$env:QA_LIVE_SUPABASE="true"
$env:QA_USE_EXISTING_SERVER="true"
$env:QA_BASE_URL="http://127.0.0.1:8080"
npm.cmd run test:e2e -- persistence.spec.ts
```
