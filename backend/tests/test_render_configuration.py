from deploy.render.start import configure_environment


def test_render_postgres_url_uses_installed_driver_and_same_origin():
    env = {'PULSE_DATABASE_URL': 'postgresql://user:password@db/pulse', 'RENDER_EXTERNAL_URL': 'https://assigned-domain.onrender.com/'}
    configure_environment(env)
    assert env['PULSE_DATABASE_URL'] == 'postgresql+psycopg://user:password@db/pulse'
    assert env['PULSE_GOOGLE_REDIRECT_URI'] == 'https://assigned-domain.onrender.com/api/v1/auth/google/callback'
    assert env['PULSE_CORS_ALLOWED_ORIGINS'] == 'https://assigned-domain.onrender.com'
    assert env['PULSE_AUTH_SUCCESS_REDIRECT'] == 'https://assigned-domain.onrender.com/'


def test_existing_sqlalchemy_driver_url_is_preserved():
    env = {'PULSE_DATABASE_URL': 'postgresql+psycopg://db/pulse'}
    configure_environment(env)
    assert env == {'PULSE_DATABASE_URL': 'postgresql+psycopg://db/pulse'}
