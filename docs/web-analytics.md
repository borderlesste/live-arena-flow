# Analítica web

## Objetivo

El panel `/admin/analytics` muestra visitas y páginas vistas por día, últimos 7 días, últimos 30 días y últimos 12 meses. Las métricas internas de streams y patrocinadores continúan funcionando sin cambios.

## Flujo de datos

1. `src/app/layout.tsx` carga el beacon oficial de Cloudflare después de la hidratación.
2. Cloudflare Web Analytics agrega las visitas sin que la aplicación almacene IP, agente de usuario o identidad personal.
3. El backend consulta `rumPageloadEventsAdaptiveGroups` mediante un token privado con permiso `Account Analytics: Read`.
4. Los agregados diarios se guardan mediante `service_role` en `public.web_analytics_daily`.
5. La API administrativa exige un usuario con rol `admin` o `super_admin` y entrega únicamente totales agregados.
6. Vercel Cron sincroniza los últimos tres días cada madrugada para absorber correcciones tardías del proveedor.

## Configuración

- Crear un sitio de Web Analytics para `luisromerofutbol.com` y copiar su token de 32 caracteres.
- Configurar `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` en Vercel.
- Configurar `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_API_TOKEN` y `CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN` en el backend.
- Generar un secreto aleatorio y configurar el mismo `CRON_SECRET` en Vercel y en el backend.
- Mantener `CLOUDFLARE_STREAM_API_TOKEN` separado; su permiso de escritura de Stream no es necesario para analítica.

Si Cloudflare está temporalmente inaccesible, la API devuelve el histórico ya persistido y el panel informa el estado degradado. Si la integración aún no está configurada, las métricas administrativas anteriores siguen visibles.

## Retención

Cloudflare permite consultar una ventana limitada del dataset. La sincronización diaria conserva agregados propios a largo plazo. La primera consulta anual solo puede recuperar hasta 180 días anteriores desde Cloudflare; el año completo estará disponible conforme se acumule el histórico local.
