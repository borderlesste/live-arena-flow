# Correos de autenticación

Plantillas HTML listas para los flujos activos de Supabase Auth.

| Flujo | Asunto | Archivo |
| --- | --- | --- |
| Confirmación de registro | `Confirma tu cuenta · Luis Romero Fútbol` | `confirmation.html` |
| Recuperación de contraseña | `Recupera el acceso a tu cuenta · Luis Romero Fútbol` | `recovery.html` |

## Aplicación en el proyecto alojado

En Supabase Dashboard, abre **Authentication → Emails → Templates**, selecciona cada flujo, copia el asunto y el HTML correspondiente y guarda los cambios.

Las plantillas usan `{{ .ConfirmationURL }}`, la variable oficial de Supabase para conservar el flujo y los redirects existentes.

## Requisito de producción: SMTP propio

La plantilla corrige contenido, idioma y marca, pero el remitente genérico `Supabase Auth <noreply@mail.app.supabase.io>` solo desaparece al configurar SMTP propio en **Authentication → Emails → SMTP Settings**.

Configuración recomendada:

- Sender name: `Luis Romero Fútbol`
- Sender email: una cuenta verificada del dominio `luisromerofutbol.com`
- Dominio con SPF y DKIM habilitados
- DMARC inicialmente en modo de monitoreo y endurecido después de validar entregabilidad

Nunca guardes la contraseña SMTP ni tokens de administración en el repositorio.
