# KazehanaCloud: Workflow OAuth + Multi‑Tenant (PMS Core + Apps Aisladas como Melon)

Este documento describe una estructura recomendada de dominios, autenticacion (OAuth/OIDC), emision/validacion de tokens, y flujo multi‑tenant para:

- **Core PMS** (el centro de todo, multi‑tenant, 1000+ hoteles).
- **Apps aisladas** (por ejemplo, **Melon**) que deben vivir bajo tu dominio, pero sin mezclar bases de datos ni permisos con el core.

El objetivo es **SSO (Single Sign‑On)** centralizado con `oauth.kazehanacloud.com`, y APIs separadas por app con control de audiencia (`aud`) y tenant (`tenantId`).

---

## 1) Estructura de Dominios (Recomendada)

### Dominio principal
- `www.kazehanacloud.com`
  - Landing/marketing, docs publicas, soporte.
  - No se toca para auth ni APIs (evita riesgos).

### Core PMS
- `app.kazehanacloud.com`
  - App web PMS (dashboard).
- `api.kazehanacloud.com`
  - API PMS (multi‑tenant).

### Auth central (SSO)
- `oauth.kazehanacloud.com`
  - Proveedor de identidad (IdP) OAuth2/OIDC.
  - Unifica login/registro/recuperacion, emite tokens.

### App aislada: Melon
- `melon.kazehanacloud.com`
  - Frontend web (si aplica) o landing de Melon.
- `api-melon.kazehanacloud.com`
  - API propia de Melon (su BD, su modelo, su ritmo de despliegue).

> Variantes:
> - Si Melon es solo movil, aun conviene `api-melon.kazehanacloud.com`.
> - Si hay mas apps: `foo.kazehanacloud.com` + `api-foo.kazehanacloud.com`.

---

## 2) DNS + TLS (Certificados)

1. En DNS, crear registros:
   - `A/AAAA` o `CNAME` para:
     - `app`, `api`, `oauth`, `melon`, `api-melon` (y los que uses).
2. TLS:
   - Usar certificados por subdominio o wildcard `*.kazehanacloud.com`.
   - Mantener **HTTPS obligatorio** para OAuth/OIDC en produccion.

---

## 3) Enrutamiento (Reverse Proxy / Gateway)

Una forma comun es usar un proxy/gateway (Cloudflare, Nginx, Traefik, etc.):

- `www.kazehanacloud.com` -> servidor marketing
- `app.kazehanacloud.com` -> frontend PMS
- `api.kazehanacloud.com` -> backend PMS
- `oauth.kazehanacloud.com` -> IdP/servicio auth
- `melon.kazehanacloud.com` -> frontend Melon
- `api-melon.kazehanacloud.com` -> backend Melon

Beneficios:
- Separacion total (apps aisladas).
- Rate limit / WAF por subdominio.
- Deploys independientes.
- CORS por origen controlado.

---

## 4) OAuth/OIDC: Flujos por Plataforma

### 4.1 App web (PMS o Melon web)
Flujo recomendado: **Authorization Code + PKCE** (OIDC).

1. `app.*` redirige a:
   - `oauth.kazehanacloud.com/authorize?...`
2. Login/consent en `oauth.*`
3. Redireccion a:
   - `https://app.kazehanacloud.com/callback`
   - o `https://melon.kazehanacloud.com/callback`
4. La app intercambia `code` por tokens en:
   - `oauth.kazehanacloud.com/token`
5. La app llama API con `Authorization: Bearer <access_token>`.

### 4.2 Movil (Expo / iOS / Android)
Dos patrones validos:

**A) Universal Links (recomendado en produccion)**
- Callback HTTPS tipo:
  - `https://melon.kazehanacloud.com/oauth/callback`
**B) Custom Scheme**
- Callback tipo:
  - `melon://oauth/callback`

Igual: Code + PKCE.

---

## 5) Multi‑Tenant: Como resolver el Tenant

Para 1000+ hoteles, evita depender de "un subdominio por hotel" como mecanismo principal.

### Recomendacion
El **tenant viaja en el token** (claim `tenantId`) y el backend aplica filtros obligatorios.

#### Casos:
1. Usuario pertenece a 1 solo hotel
   - `tenantId` fijo en token.
2. Usuario pertenece a varios hoteles
   - login emite token "sin tenant" y la app hace "seleccion de hotel".
   - luego se emite un token "con tenant" o se usa un `X-Tenant` firmado.

En ambos casos, el backend debe asegurar:
- Ninguna query se ejecute sin `tenantId`.
- Validacion de pertenencia (usuario -> tenant).

---

## 6) Tokens: Claims recomendados (Access Token)

Para que PMS y Melon compartan SSO sin mezclar permisos:

- `iss`: `https://oauth.kazehanacloud.com`
- `sub`: `userId`
- `aud`: audiencia del backend destino
  - PMS API: `pms-api`
  - Melon API: `melon-api`
- `tenantId`: ID del hotel/empresa (cuando aplique)
- `role`: rol (owner/staff/admin, etc.)
- `scp` / `permissions`: permisos
- `exp`, `iat`

Regla:
- `api.kazehanacloud.com` solo acepta tokens con `aud=pms-api`.
- `api-melon.kazehanacloud.com` solo acepta tokens con `aud=melon-api`.

Esto evita que un token del PMS sirva automaticamente para Melon si no debe.

---

## 7) Melon aislada (App) pero con SSO

### 7.1 Aislamiento recomendado
- BD propia (por ejemplo `melon_db`) o esquema separado.
- API propia `api-melon.kazehanacloud.com`.
- Tokens con `aud=melon-api`.

### 7.2 Vinculo con PMS (opcional)
Si Melon necesita leer "hoteles/usuarios" del PMS:
- No compartir BD.
- Usar integracion via API del PMS o eventos (cola).
- Mantener boundaries: permisos y auditoria.

---

## 8) Redirect URIs (Checklist)

Configurar en `oauth.kazehanacloud.com` (por app/client):

### PMS Web
- Allowed callback:
  - `https://app.kazehanacloud.com/callback`
- Allowed logout:
  - `https://app.kazehanacloud.com/`

### Melon Web
- Allowed callback:
  - `https://melon.kazehanacloud.com/callback`
- Allowed logout:
  - `https://melon.kazehanacloud.com/`

### Melon Movil (si aplica)
- Allowed callback:
  - `melon://oauth/callback` (si custom scheme)
  - o `https://melon.kazehanacloud.com/oauth/callback` (si universal links)

---

## 9) CORS (Reglas simples)

- `api.kazehanacloud.com`
  - permitir origen `https://app.kazehanacloud.com` (y solo los necesarios).
- `api-melon.kazehanacloud.com`
  - permitir origen `https://melon.kazehanacloud.com` (si hay web).

Movil: CORS no aplica igual, pero mantenerlo cerrado igual ayuda.

---

## 10) Seguridad y Operacion (Checklist)

- HTTPS obligatorio en `oauth` y `api`.
- Rotacion de llaves (JWKS si usas OIDC).
- Rate limiting:
  - fuerte en `/token`, `/authorize`, `/login`.
- Logs y auditoria:
  - por `tenantId`, `userId`, `aud`.
- Separar ambientes:
  - `dev-oauth.*`, `stg-oauth.*`, `oauth.*` (prod).
- Evitar tokens demasiado largos (claims minimos).
- Revocacion/refresh tokens segun plataforma:
  - web: cookies seguras o storage + rotacion.
  - movil: refresh con proteccion.

---

## 11) Plan de Implementacion (Fases)

### Fase 1: Dominios + despliegue
1. Crear DNS subdominios.
2. Levantar `api-melon` y `melon` con HTTPS.

### Fase 2: OAuth central
1. Instalar/configurar IdP (Auth0/Keycloak/Cognito/etc).
2. Registrar clients:
   - `pms-web`
   - `melon-web` (si aplica)
   - `melon-mobile` (si aplica)

### Fase 3: Token + tenant
1. Definir claims y audiencias.
2. Implementar validacion en cada API.
3. Implementar enforcement de `tenantId` en DB.

### Fase 4: Migracion de login legacy
1. Mantener login viejo temporalmente.
2. Migrar usuarios/flujo.
3. Remover login directo cuando OAuth este estable.

---

## 12) Notas sobre tu backend actual (NestJS + Prisma)

Tu backend actual tiene 2 tipos de usuario (client/business) y maneja tokens propios.
Para integrarlo a OAuth central hay dos rutas:

1. **OAuth real con IdP** (recomendado): tu API valida JWT del IdP (JWKS) y deja de emitir tokens propios.
2. **Puente temporal**: `oauth.*` autentica y tu API intercambia por token interno (solo para transicion).

---

## 13) Glosario rapido

- **IdP**: Identity Provider (Auth0, Keycloak, Cognito, etc.)
- **OIDC**: OpenID Connect (OAuth2 + identidad)
- **PKCE**: mecanismo para evitar robo de `code` en apps publicas
- **aud**: audience, "para que backend sirve este token"
- **tenantId**: hotel/empresa/espacio aislado

