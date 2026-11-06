import * as path from 'path';
import * as dotenv from 'dotenv';

// Lokale Entwicklung: backend/.env (optional) und die .env im Projekt-Root laden.
// Liegt eine Datei nicht vor (z.B. im Docker-Container), passiert nichts.
// Bereits gesetzte Umgebungsvariablen haben Vorrang und werden nicht überschrieben.
// __dirname ist src/ (ts-node) bzw. dist/ (kompiliert) - beides direkt unter backend/.
const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
dotenv.config({ path: path.join(backendDir, '..', '.env'), quiet: true });
