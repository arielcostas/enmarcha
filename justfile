# https://just.systems

default:
    just --list

run-backend:
    dotnet run --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

dev-backend:
    dotnet watch --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

dev-frontend:
    npm run dev --prefix src/frontend

build-backend:
    dotnet publish -c Release -o ./dist/backend src/Enmarcha.Backend/Enmarcha.Backend.csproj

build-backend-prod:
    dotnet publish -c Release -r linux-arm64 --self-contained false src/Enmarcha.Backend/Enmarcha.Backend.csproj -o dist/backend

build-frontend:
    npm run build --prefix src/frontend
    mkdir dist/frontend
    cp -r src/frontend/build/client/* dist/frontend

format-backend:
    dotnet format --verbosity diagnostic src/Enmarcha.Backend/Enmarcha.Backend.csproj

format-frontend:
    npx prettier --write "src/frontend/**/*.{ts,tsx,css}"

format: format-backend format-frontend

db-migrate NAME:
    dotnet ef migrations add {{NAME}} --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

db-update:
    dotnet ef database update --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

db-bundle:
    dotnet ef migrations bundle --project src/Enmarcha.Backend/Enmarcha.Backend.csproj -o dist/dbbundle
