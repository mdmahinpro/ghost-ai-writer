declare module "ssh2" {
  export class Client {
    once(event: "ready", cb: () => void): this;
    once(event: "error", cb: (error: Error) => void): this;
    connect(config: { host: string; port: number; username: string; password: string; readyTimeout?: number }): void;
    end(): void;
    sftp(cb: (error: Error | undefined, sftp: SFTPWrapper) => void): void;
  }
  export interface SFTPWrapper {
    readdir(path: string, cb: (error: Error | undefined, list: { filename: string }[]) => void): void;
    mkdir(path: string, cb: (error: Error | undefined) => void): void;
    writeFile(path: string, data: Buffer, cb: (error: Error | undefined) => void): void;
  }
}
