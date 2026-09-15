import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export class PasswordService {
  /**
   * Hashes plaintext password using bcrypt with cost factor 12.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verifies plaintext password against stored hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validates password strength according to security policy:
   * - Minimum 8 characters
   * - Must contain at least one letter and one number
   * - Rejects common weak passwords
   */
  static validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long.' };
    }

    if (password.length > 128) {
      return { isValid: false, message: 'Password cannot exceed 128 characters.' };
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      return { isValid: false, message: 'Password must contain at least one letter and one number.' };
    }

    const weakPasswords = ['password', '12345678', 'qwertyuiop', 'admin123', 'vetrx123'];
    if (weakPasswords.includes(password.toLowerCase())) {
      return { isValid: false, message: 'Password is too common or easily guessable.' };
    }

    return { isValid: true };
  }
}
