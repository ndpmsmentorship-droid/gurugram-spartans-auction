import ChangePasswordForm from "./ChangePasswordForm";

// Owners land here on their first sign-in (the proxy sends them while
// app_metadata.must_change_password is set) and can't open anything else until
// they've chosen their own password.
export default function ChangePasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <ChangePasswordForm />
    </main>
  );
}
