import React, { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../store';

/** Landing route for challenge links (onetake://c/<id>): records who invited this user, then goes home. */
export default function ChallengeLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { acceptChallenge } = useApp();

  useEffect(() => {
    if (id) acceptChallenge(id).catch(() => {});
  }, [id, acceptChallenge]);

  return <Redirect href="/(tabs)" />;
}
