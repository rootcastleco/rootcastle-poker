declare module "node:http" {
  export interface IncomingMessage {
    readonly method?: string;
    readonly url?: string;
    on(event: "data", listener: (chunk: Uint8Array) => void): this;
    on(event: "end" | "close" | "error", listener: () => void): this;
  }
  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string | readonly string[]): void;
    write(chunk: string): void;
    end(chunk?: string | Uint8Array): void;
  }
  export interface Server { listen(port: number, host: string, callback: () => void): void; }
  export function createServer(listener: (request: IncomingMessage, response: ServerResponse) => void): Server;
}
declare module "node:fs" {
  export function readFile(path: string, callback: (error: Error | null, data: Uint8Array) => void): void;
}
declare module "node:path" {
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
}
declare module "node:url" { export function fileURLToPath(url: string): string; }
declare module "node:crypto" { export function randomInt(max: number): number; }
