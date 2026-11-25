import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? '').trim();

const config: CapacitorConfig = {
  appId: 'in.railone.app',
  appName: 'RailOne',
  webDir: 'dist',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {
        server: {
          androidScheme: 'https',
        },
      }),
};

export default config;
