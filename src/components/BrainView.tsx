import React from 'react';
import { WebView } from 'react-native-webview';

/** The 3D brain page in a web view (iOS and Android). The web build uses BrainView.web.tsx. */
export default function BrainView({ url }: { url: string }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: '#0d0f14' }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      // let the brain be dragged without the results screen scrolling underneath it
      nestedScrollEnabled
      scrollEnabled={false}
    />
  );
}
