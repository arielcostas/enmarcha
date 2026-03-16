# Registro de Actividades de Tratamiento (ROPA)

**Artículo 30 del RGPD (UE) 2016/679 · Ley Orgánica 3/2018 (LOPDGDD)**

| Campo | Valor |
|---|---|
| **Responsable del tratamiento** | Ariel Costas Guerrero |
| **Contacto** | <privacidad@enmarcha.app> |
| **Fecha de elaboración** | 16 de marzo de 2026 |
| **Versión** | 1.0 |

---

## Actividades de tratamiento

### AT-01 · Consulta de llegadas a una parada

| Campo | Detalle |
|---|---|
| **Finalidad** | Mostrar las próximas llegadas de autobús a la parada consultada |
| **Categoría de datos** | Código numérico de parada (no personal) |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Interés legítimo — prestación del servicio solicitado (art. 6.1.f RGPD) |
| **Plazo de conservación** | No se almacena en servidor; caché en memoria con TTL de 15 min |
| **Destinatarios** | Vitrasa/Concello de Vigo (dados.vigo.org), TUSSA (app.tussa.org), Tranvías Coruña (itranvias.com), CTAG Shuttle, Renfe GTFS-Realtime |
| **Transferencias internacionales** | Ninguna |

---

### AT-02 · Planificación de rutas

| Campo | Detalle |
|---|---|
| **Finalidad** | Calcular itinerarios de transporte público entre dos puntos |
| **Categoría de datos** | Coordenadas de origen y destino (WGS84), hora de viaje, preferencia salida/llegada |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Interés legítimo — prestación del servicio solicitado (art. 6.1.f RGPD) |
| **Plazo de conservación** | No se almacena en servidor; caché en localStorage del dispositivo con TTL de 2 h |
| **Destinatarios** | OpenTripPlanner (URL configurada en backend) |
| **Transferencias internacionales** | Depende de dónde se aloje OpenTripPlanner |

---

### AT-03 · Geocodificación y geocodificación inversa

| Campo | Detalle |
|---|---|
| **Finalidad** | Convertir texto de búsqueda en coordenadas, o coordenadas en nombre de lugar |
| **Categoría de datos** | Texto de búsqueda libre O coordenadas lat/lon |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Interés legítimo — prestación del servicio solicitado (art. 6.1.f RGPD) |
| **Plazo de conservación** | No se almacena en servidor; caché en memoria con TTL de 60 min |
| **Destinatarios** | Geoapify (api.geoapify.com) — ver política en geoapify.com/privacy-policy |
| **Transferencias internacionales** | Posible transferencia a servidores de Geoapify fuera del EEE; Geoapify tiene Privacy Shield / SCCs |

---

### AT-04 · Paradas favoritas y nombres personalizados

| Campo | Detalle |
|---|---|
| **Finalidad** | Recordar las paradas que el usuario marca como favoritas y los nombres que les asigna |
| **Categoría de datos** | Identificadores de parada (p. ej. `vitrasa:1400`), nombres de texto libre introducidos por el usuario |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Acción propia del interesado (función solicitada voluntariamente, art. 6.1.a/f RGPD) |
| **Plazo de conservación** | Indefinido en localStorage del dispositivo; el usuario puede borrarlos en cualquier momento |
| **Destinatarios** | Nadie — solo localStorage del dispositivo del usuario |
| **Transferencias internacionales** | Ninguna |

---

### AT-05 · Paradas y lugares recientes

| Campo | Detalle |
|---|---|
| **Finalidad** | Mostrar sugerencias de paradas y búsquedas recientes para agilizar el uso |
| **Categoría de datos** | Códigos de parada, coordenadas de búsquedas del planificador, nombres de lugares |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Interés legítimo — facilitar el uso recurrente de la aplicación (art. 6.1.f RGPD) |
| **Plazo de conservación** | Indefinido en localStorage; máx. 20 lugares / 10 paradas; el usuario puede borrarlos |
| **Destinatarios** | Nadie — solo localStorage del dispositivo del usuario |
| **Transferencias internacionales** | Ninguna |

---

### AT-06 · Ubicaciones de casa y trabajo

| Campo | Detalle |
|---|---|
| **Finalidad** | Permitir que el usuario configure atajos hacia sus ubicaciones habituales |
| **Categoría de datos** | Nombre descriptivo, tipo (parada o dirección), coordenadas lat/lon |
| **Interesados** | Usuarios de la aplicación |
| **Base jurídica** | Acción propia del interesado (función configurada voluntariamente, art. 6.1.f RGPD) |
| **Plazo de conservación** | Indefinido en localStorage; el usuario puede borrarlos en cualquier momento |
| **Destinatarios** | Nadie — solo localStorage del dispositivo del usuario |
| **Transferencias internacionales** | Ninguna |

---

### AT-07 · Posición GPS del mapa

| Campo | Detalle |
|---|---|
| **Finalidad** | Centrar el mapa en la posición del usuario; calcular paradas cercanas |
| **Categoría de datos** | Coordenadas GPS (lat/lon) |
| **Interesados** | Usuarios de la aplicación que conceden permiso de geolocalización |
| **Base jurídica** | Consentimiento del interesado a través del permiso de geolocalización del navegador (art. 6.1.a RGPD) |
| **Plazo de conservación** | 30 días en localStorage; se descarta automáticamente al superarse |
| **Destinatarios** | Solo se transmite al servidor si el usuario inicia una planificación de ruta desde su posición actual (AT-02) |
| **Transferencias internacionales** | Ninguna (salvo si aplica AT-02) |

---

### AT-08 · Registros operativos del servidor

| Campo | Detalle |
|---|---|
| **Finalidad** | Diagnóstico de errores, monitorización de disponibilidad y seguridad |
| **Categoría de datos** | Dirección IP **anonimizada** (IPv4: /24; IPv6: /48), identificadores de parada/ruta, método HTTP, código de respuesta |
| **Interesados** | Cualquier usuario que acceda a la API backend |
| **Base jurídica** | Interés legítimo — operación segura del servicio (art. 6.1.f RGPD) |
| **Plazo de conservación** | Rotación estándar de logs del servidor (típicamente 7-30 días) |
| **Destinatarios** | Solo el responsable del tratamiento |
| **Transferencias internacionales** | Depende del proveedor de hosting |
| **Nota técnica** | Los IPs se truncan _antes_ de que entren en el pipeline de logging mediante middleware de ASP.NET Core |

---

### AT-09 · Telemetría de rendimiento (OpenTelemetry)

| Campo | Detalle |
|---|---|
| **Finalidad** | Monitorización de rendimiento, trazabilidad de errores |
| **Categoría de datos** | Identificadores de parada/ruta, duración de peticiones, códigos de estado — **sin coordenadas ni IPs completas** |
| **Interesados** | Cualquier usuario que acceda a la API backend |
| **Base jurídica** | Interés legítimo — mejora del servicio (art. 6.1.f RGPD) |
| **Plazo de conservación** | Según configuración del colector OTLP (si se activa) |
| **Destinatarios** | Colector OTLP autogestionado o tercero (p. ej. Grafana Cloud) si se configura |
| **Transferencias internacionales** | Posible si se usa SaaS de telemetría fuera del EEE |
| **Nota técnica** | Las coordenadas (lat/lon) se han eliminado de los atributos de span; las IPs se anonymizan vía `EnrichWithHttpRequest` |

---

## Medidas técnicas y organizativas

| Medida | Descripción |
|---|---|
| Anonimización de IPs | IPv4 → último octeto = 0; IPv6 → últimos 80 bits = 0 (antes de logs y spans) |
| Sin coordenadas en spans | El atributo `lat`/`lon` se ha eliminado de los spans de OpenTelemetry |
| User-Agent sin email | El encabezado User-Agent enviado a Geoapify y Nominatim no contiene datos personales del responsable |
| Expiración automática de ubicación | La posición GPS guardada en localStorage se descarta tras 30 días |
| Borrado por el usuario | Los usuarios pueden eliminar todos sus datos locales desde Ajustes → Privacidad y datos |
| Sin cuentas de usuario | No se crean perfiles, contraseñas ni identificadores persistentes de usuario |
| Sin cookies de seguimiento | Solo se usa `localStorage` de primer nivel y, opcionalmente, una cookie de idioma |
| Política de privacidad pública | Disponible en `/politica-privacidad` dentro de la aplicación |

---

_Documento interno para uso del responsable del tratamiento. No es un documento público._
