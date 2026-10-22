import { Client } from "ssh2";

const SFTP_PORT = 65002;

type RemoteFile = { name: string; base64: string };

function connect(host: string, user: string, password: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const timer = setTimeout(() => {
      client.end();
      reject(new Error("SFTP on port 65002 did not answer."));
    }, 10000);
    client.once("ready", () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once("error", (error) => {
      clearTimeout(timer);
      client.end();
      reject(error);
    });
    client.connect({ host, port: SFTP_PORT, username: user, password, readyTimeout: 10000 });
  });
}

function session<T>(host: string, user: string, password: string, run: (sftp: import("ssh2").SFTPWrapper) => Promise<T>): Promise<T> {
  return connect(host, user, password).then(
    (client) =>
      new Promise((resolve, reject) => {
        client.sftp((error, sftp) => {
          if (error || !sftp) {
            client.end();
            reject(error ?? new Error("SFTP session did not open."));
            return;
          }
          run(sftp).then(
            (value) => {
              client.end();
              resolve(value);
            },
            (failure) => {
              client.end();
              reject(failure);
            },
          );
        });
      }),
  );
}

export function sftpList(host: string, user: string, password: string, path: string): Promise<string> {
  const target = !path || path === "/" ? "." : path.replace(/^\/+/, "");
  return session(host, user, password, (sftp) => {
    return new Promise((resolve, reject) => {
      sftp.readdir(target, (error, list) => {
        if (error) reject(error);
        else resolve((list ?? []).map((entry) => entry.filename).join("\n"));
      });
    });
  });
}

function mkdir(sftp: import("ssh2").SFTPWrapper, dir: string): Promise<void> {
  return new Promise((resolve) => {
    sftp.mkdir(dir, () => resolve());
  });
}

function writeFile(sftp: import("ssh2").SFTPWrapper, name: string, bytes: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(name, bytes, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function sftpUpload(host: string, user: string, password: string, path: string, files: RemoteFile[]): Promise<number> {
  const root = !path || path === "/" ? "" : path.replace(/^\/+|\/+$/g, "");
  return session(host, user, password, async (sftp) => {
    const made = new Set<string>();
    for (const file of files) {
      const name = root ? `${root}/${file.name}` : file.name;
      const parts = name.split("/").slice(0, -1);
      let dir = "";
      for (const part of parts) {
        dir = dir ? `${dir}/${part}` : part;
        if (made.has(dir)) continue;
        await mkdir(sftp, dir);
        made.add(dir);
      }
      await writeFile(sftp, name, Buffer.from(file.base64, "base64"));
    }
    return files.length;
  });
}
