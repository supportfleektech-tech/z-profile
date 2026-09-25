declare module 'express' {
  import type { Server } from 'node:http';

  interface ExpressApp {
    use(...args: unknown[]): ExpressApp;
    json(...args: unknown[]): ExpressApp;
    listen(...args: unknown[]): Server;
  }

  const express: {
    (): ExpressApp;
    json(...args: unknown[]): ExpressApp;
  };

  export default express;
}
