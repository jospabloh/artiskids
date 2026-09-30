// Shared by Login and Register. Base44 answers a password login for an account
// whose email was never verified with a message about a verification code; the
// register flow sends that code by email. Without a place to type it the user
// is stuck, so Login opens the code step instead of showing the raw error.
export const needsEmailVerification = (error) =>
  /verify your email|verification code|email.*not verified|not verified/i.test(
    error?.message || ""
  );
