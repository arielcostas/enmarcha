# https://just.systems
DEPLOY_HOST := "bravo"
DEPLOY_USER := "app"

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


deploy-backend:
    dotnet publish -c Release -r linux-arm64 --self-contained false src/Enmarcha.Backend/Enmarcha.Backend.csproj -o dist/backend
    ssh {{DEPLOY_USER}}@{{DEPLOY_HOST}} "sudo /usr/bin/systemctl stop enmarcha"
    @rclone copy dist/backend/ :sftp,user={{DEPLOY_USER}},host={{DEPLOY_HOST}},key_use_agent=true:/opt/enmarcha --transfers 5 --progress
    ssh {{DEPLOY_USER}}@{{DEPLOY_HOST}} "chmod +x /opt/enmarcha/Enmarcha.Backend /opt/enmarcha/efbundle"
    ssh {{DEPLOY_USER}}@{{DEPLOY_HOST}} "cd /opt/enmarcha && ASPNETCORE_ENVIRONMENT=Production ./efbundle"
    ssh {{DEPLOY_USER}}@{{DEPLOY_HOST}} "sudo /usr/bin/systemctl start enmarcha"


db-migrate NAME:
    dotnet ef migrations add {{NAME}} --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

db-update:
    dotnet ef database update --project src/Enmarcha.Backend/Enmarcha.Backend.csproj

db-bundle:
    dotnet ef migrations bundle --project src/Enmarcha.Backend/Enmarcha.Backend.csproj -o dist/dbbundle
