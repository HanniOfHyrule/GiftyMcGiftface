import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Field, useForm } from '@tanstack/react-form';
import { FieldInfo } from './FieldInfo';
import { authApi } from '../APIService';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: '', password: '', name: '', lastName: '' },
    onSubmit: async ({ value }) => {
      setLoading(true);
      setError(null);
      try {
        if (isRegisterMode) {
          if (
            !value.email ||
            !value.password ||
            !value.name ||
            !value.lastName
          ) {
            setError('Bitte alle Felder ausfüllen.');
            setLoading(false);
            return;
          }
          if (value.password.length < 6) {
            setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
            setLoading(false);
            return;
          }
          await authApi.register(value);
        } else if (!value.email || !value.password) {
          setError('Bitte E-Mail und Passwort eingeben.');
          return;
        }

        const response = await authApi.login(value.email, value.password);
        if (!response.token || typeof response.token !== 'string') {
          setError('Login fehlgeschlagen: Kein Token erhalten.');
          return;
        }
        login(
          response.token,
          response.refreshToken ?? '',
          response.name || value.name,
        );
        navigate('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="bg-white p-8 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isRegisterMode ? 'Registrieren' : 'Login'}
        </h2>
        {error && <div className="mb-4 text-red-500">{error}</div>}
        <div className="mb-4">
          <Field name="email" form={form}>
            {(field) => (
              <>
                <label htmlFor={field.name}>E-Mail</label>
                <input
                  id={field.name}
                  className="w-full border px-3 py-2 rounded"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
                <FieldInfo field={field} />
              </>
            )}
          </Field>
        </div>
        <div className="mb-6">
          <Field name="password" form={form}>
            {(field) => (
              <>
                <label htmlFor={field.name}>Passwort</label>
                <input
                  id={field.name}
                  className="w-full border px-3 py-2 rounded"
                  value={field.state.value}
                  type="password"
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
                <FieldInfo field={field} />
              </>
            )}
          </Field>
        </div>
        {!isRegisterMode && (
          <div className="mb-4 text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => setIsRegisterMode(true)}
            >
              Noch keinen Account? Jetzt registrieren!
            </button>
          </div>
        )}
        {isRegisterMode && (
          <>
            <div className="mb-4">
              <Field name="name" form={form}>
                {(field) => (
                  <>
                    <label htmlFor={field.name}>Vorname</label>
                    <input
                      id={field.name}
                      className="w-full border px-3 py-2 rounded"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                    <FieldInfo field={field} />
                  </>
                )}
              </Field>
            </div>
            <div className="mb-6">
              <Field name="lastName" form={form}>
                {(field) => (
                  <>
                    <label htmlFor={field.name}>Nachname</label>
                    <input
                      id={field.name}
                      className="w-full border px-3 py-2 rounded"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                    <FieldInfo field={field} />
                  </>
                )}
              </Field>
            </div>
          </>
        )}
        <form.Subscribe selector={(state) => state}>
          {(state) => (
            <div className="mb-4 text-center">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
                disabled={!state.canSubmit || loading}
              >
                {state.isSubmitting || loading
                  ? isRegisterMode
                    ? 'Registrieren...'
                    : 'Einloggen...'
                  : isRegisterMode
                    ? 'Registrieren'
                    : 'Login'}
              </button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
};

export default LoginPage;
