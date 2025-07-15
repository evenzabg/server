import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  register(email: string, password: string) {
    // TODO: persist user
    return { id: Date.now(), email };
  }

  login(email: string, password: string) {
    // TODO: validate user credentials
    return { accessToken: 'fake-jwt-token' };
  }

  getData(): { message: string } {
    return { message: 'Hello API' };
  }
}
