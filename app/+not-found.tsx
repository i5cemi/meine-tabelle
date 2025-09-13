import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';


import { useEffect } from 'react';

export default function NotFoundScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  shadow: {
    boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
  },
});
