import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  // Dev-only: Suppress noisy RNW deprecation warnings on web about shadow* and props.pointerEvents
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    const originalWarn = console.warn;
    // @ts-ignore allow monkey patch in dev
    console.warn = (...args: any[]) => {
      const msg = String(args?.[0] ?? '');
      if (
        msg.includes('"shadow*" style props are deprecated. Use "boxShadow"') ||
        msg.includes('props.pointerEvents is deprecated. Use style.pointerEvents')
      ) {
        return; // swallow
      }
      // pass through everything else
      originalWarn.apply(console, args as any);
    };
  }

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Removed aggressive global print CSS to avoid empty pages */}
        {Platform.OS === 'web' && (
          // Minimal global print rule: hide elements explicitly marked as print-hide
          <style
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  .print-hide { display: none !important; }
                }
              `,
            }}
          />
        )}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
