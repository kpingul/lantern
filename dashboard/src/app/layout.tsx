import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'Lantern',
  description: 'Shine a light on your local network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content */}
            <main className="ml-64 flex-1 min-h-screen">
              <div className="grid-pattern scanlines relative min-h-screen">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
