import axios from 'axios';

describe('AuthService e2e', () => {
  it('POST /auth/register', async () => {
    const res = await axios.post('/auth/register', {
      email: 'test@example.com',
      password: 'password',
    });
    expect(res.status).toBe(201);
    expect(res.data.email).toBe('test@example.com');
  });

  it('GET /auth/docs-json', async () => {
    const res = await axios.get('/auth/docs-json');
    expect(res.status).toBe(200);
    expect(res.data.info.title).toBe('auth-service');
  });
});
