import {
  applyDatabaseUrl,
  buildDatabaseUrl,
} from '../scripts/apply-database-url.cjs';

describe('buildDatabaseUrl', () => {
  const baseEnv = {
    POSTGRES_USER: 'nativelocation',
    POSTGRES_PASSWORD: 'nativelocation',
    POSTGRES_DB: 'nativelocation',
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: '16875',
  };

  it('用 POSTGRES_* 拼接 Prisma 连接串', () => {
    expect(buildDatabaseUrl(baseEnv)).toBe(
      'postgresql://nativelocation:nativelocation@127.0.0.1:16875/nativelocation?schema=public',
    );
  });

  it('对用户名与密码做 URL 编码', () => {
    expect(
      buildDatabaseUrl({
        ...baseEnv,
        POSTGRES_USER: 'user@name',
        POSTGRES_PASSWORD: 'p@ss#word',
      }),
    ).toBe(
      'postgresql://user%40name:p%40ss%23word@127.0.0.1:16875/nativelocation?schema=public',
    );
  });

  it('生产 Compose 主机使用服务名与容器内端口', () => {
    expect(
      buildDatabaseUrl({
        ...baseEnv,
        POSTGRES_HOST: 'postgres',
        POSTGRES_PORT: '5432',
      }),
    ).toBe(
      'postgresql://nativelocation:nativelocation@postgres:5432/nativelocation?schema=public',
    );
  });

  it('缺少变量时抛错', () => {
    expect(() => buildDatabaseUrl({ POSTGRES_USER: 'only-user' })).toThrow(
      /POSTGRES_HOST/,
    );
  });
});

describe('applyDatabaseUrl', () => {
  it('写入 DATABASE_URL', () => {
    const env: NodeJS.ProcessEnv = {
      POSTGRES_USER: 'nativelocation',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_DB: 'nativelocation',
      POSTGRES_HOST: '127.0.0.1',
      POSTGRES_PORT: '16875',
    };

    applyDatabaseUrl(env);

    expect(env.DATABASE_URL).toBe(
      'postgresql://nativelocation:secret@127.0.0.1:16875/nativelocation?schema=public',
    );
  });

  it('optional 且变量不全时写入占位连接串', () => {
    const env: NodeJS.ProcessEnv = {};
    applyDatabaseUrl(env, { optional: true });
    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);
  });
});
