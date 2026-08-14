import './load-root-env';

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';

import { AppModule } from './app.module';
import { assertProductionApiKey } from './auth/api-key';

async function bootstrap() {
  assertProductionApiKey();

  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((item) => item.trim()),
    });
  } else if (process.env.NODE_ENV === 'production') {
    app.enableCors({ origin: false });
  } else {
    app.enableCors({ origin: true });
  }

  app.useWebSocketAdapter(new WsAdapter(app));

  const port = Number(process.env.PORT ?? 18156);
  await app.listen(port, '0.0.0.0');

  console.log(`API listening on http://0.0.0.0:${port}`);
}

void bootstrap();
