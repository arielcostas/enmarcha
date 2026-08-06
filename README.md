# EnMarcha

EnMarcha es una aplicación web progresiva (con una [versión móvil en desarrollo](https://codeberg.org/arielcostas/enmarcha-android)), con información sobre el transporte público en Galicia (España), combinando autobús urbano, interurbano, tren (regional, alta velocidad y ancho métrico) y barco.

## Funcionalidades

- **Transporte intermodal**: información de transporte público urbano en las principales ciudades (Vigo, Pontevedra, A Coruña, Ferrol)[^1], transporte interurbano regional (Xunta de Galicia), ferrocarril (MD/Regional, alta velocidad y ancho métrico Ferrol-Ortigueira-Ribadeo-Oviedo) y marítimo (Vigo-Moaña y Vigo-Cangas).
- **Datos en tiempo real**: llegadas y posiciones en tiempo real, a partir de los datos oficiales de las agencias de transporte y administraciones.
- **Planificación de rutas**: Planificación de rutas entre ubicaciones, combinando transporte público y caminando.
- **Mapa interactivo** de paradas y recorridos.
- **Sin publicidad ni _trackers_**: Experiencia limpia, sin publicidad ni invadir la privacidad del usuario, como diferenciación de otras aplicaciones extranjeras.
- **Software libre**: Toda la base de código, así como la configuración de OpenTripPlanner servida están bajo licencias de software libre.

[^1]: Los datos de Santiago de Compostela y Ourense están parcialmente, a la espera de feeds oficiales con los cambios de concesiones. Lugo es de elaboración propia, en base a los datos publicados por el Concello.

## Pila tecnológica

- **Servidor**: ASP.NET Core 10 Web API, con PostgreSQL para algunas funcionalidades
- **Cliente web**: React, TypeScript, Vite
- **Estilos**: Tailwind CSS
- **Rutas y datos de transporte**: [OpenTripPlanner](https://opentripplanner.org) con [feeds adaptados a Galicia](https://codeberg.org/tpgalicia/opentripplanner-galicia.git).
- **Cartografía**:
  - [MapLibre-GL](https://maplibre.org)
  - OpenStreetMap con teselas de [OpenFreeMap tiles](https://openfreemap.org)
  - Capa de teselas personalizada con la información de paradas (MVTs) y recorridos (GeoJSON)

## Desarollo

### Requisitos previos

- Node 24 y npm
- SDK de .NET 10
- Instancia de OpenTripPlanner desplegada localmente
- [Just](https://just.systems)

### Instalación

1. Clonar el repositorio:

    ```sh
    git clone https://codeberg.org/arielcostas/enmarcha.git
    cd enmarcha
    ```

2. Instalar dependencias:

    ```sh
    npm i
    dotnet restore
    ```

3. TODO: Documentar configuración de servidor

4. Ejecutar servidor con `just dev-backend`, y aplicación web con `just dev-frontend`.

## Contribuciones

Las contribuciones siempre son bienvenidas, a través de incidencias o _pull requests_ en el [repositorio de Codeberg](https://codeberg.org/arielcostas/enmarcha).

No se admiten contribuciones creadas mayoritariamente con herramientas de IA generativa, aquellas donde el uso sea notable serán rechazadas. Todo esto de acuerdo con la política de IA de Codeberg.

## License

Este proyecto está publicado bajo licencia GNU Affero General Public Licence 3.0, disponible en el archivo [LICENCE](./LICENCE).

Los datos que se sirven están disponibles bajo licencias distintas, ya que proceden de administraciones públicas o empresas de transporte, o son elaboración propia a partir de dichos datos.
