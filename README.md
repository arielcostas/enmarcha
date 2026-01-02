# EnMarcha

EnMarcha (formerly known as Busurbano) is a progressive web application designed to help users find public transit information in Galicia, Spain.

## Features

- **Multi-Modal Support**: Currently supports bus transit in Vigo, A Coruña and (WIP) Santiago de Compostela, with plans to map all of Galicia's public transit systems. Also includes support for Xunta de Galicia's intercity bus services and Renfe's trains.
- **Real-time data**: Integrates and consolidates real-time data from agencies that provide it: Vitrasa (Vigo), Tranvías de A Coruña (A Coruña) and TUSSA (Santiago de Compostela).
- **Route planning**: Plan routes between two locations using public transit, walking, and cycling.
- **Interactive Map**: View bus stops on an interactive map with real-time arrival information.
- **No ads, no politics, no tracking**: A clean, user-focused experience with all the public information available. No ads (unlike certain foreign third-party app), no tracking, and no political agendas.
- **Open Source**: The entire codebase is open source and available on GitHub.

## Technology stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: ASP.NET Core 9 Web API
- **Routing and Transit Data API**: [OpenTripPlanner](https://opentripplanner.org)
- **Mapping**:
  - [MapLibre GL JS](https://maplibre.org)
  - OpenStreetMap via [OpenFreeMap tiles](https://openfreemap.org)
  - Custom tile layers with the app's information (generated on the fly as MVTs)

## Getting Started

TODO: Update instructions

### Prerequisites

- Node 22 and npm
- .NET 9 SDK

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/arielcostas/enmarcha.git
   cd enmarcha
   ```

2. Install dependencies:

   ```sh
   npm i
   dotnet restore
   ```

### Running the Application

1. Start the entire application:

    ```sh
    npm run dev
    ```

2. Open your browser and navigate to `http://localhost:5173`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licenced under the BSD 3-Clause licence, meaning you can do whatever you want with it as long as you include the original copyright and license notice.

Note that the data served by the application is obtained from [datos.vigo.org](https://datos.vigo.org) under the [Open Data Commons Attribution License](https://opendefinition.org/licenses/odc-by/), so you must comply with the terms of that license if you use the data in your own projects.
