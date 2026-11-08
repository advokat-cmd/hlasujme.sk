type HomeProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Nesprávny e-mail alebo heslo.",
  rate: "Príliš veľa pokusov. Skúste to znova o minútu.",
  server: "Prihlásenie sa nepodarilo. Skúste to znova.",
};

export default async function Home({ searchParams }: HomeProps) {
  const rawError = (await searchParams).error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const error = errorCode ? ERROR_MESSAGES[errorCode] : undefined;

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Prihlásenie</h1>
        <form action="/api/auth/login" method="post">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            autoFocus
          />

          <label htmlFor="password">Heslo</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {error ? <p className="login-error" role="alert">{error}</p> : null}

          <button type="submit">Prihlásiť</button>
        </form>
      </section>
    </main>
  );
}
