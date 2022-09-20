import {useRootContext} from '../contexts/RootContext';
import {Text, useUIKitTheme} from '@sendbird/uikit-react-native-foundation';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useEffect, useState} from 'react';
import {AppState, View} from 'react-native';

export const CONNECTION_STATE_HEIGHT = 24;

const ConnectionStateView = () => {
  const {sdk} = useRootContext();

  const {colors} = useUIKitTheme();
  const {top} = useSafeAreaInsets();

  const [text, setText] = useState('');

  const forceUpdate = (msg: string) => {
    setText(msg);
  };

  useEffect(() => {
    const KEY = 'root';
    const handler = new sdk.ConnectionHandler();

    handler.onReconnectFailed = () => forceUpdate('onReconnectFailed');
    handler.onReconnectStarted = () => forceUpdate('onReconnectStarted');
    handler.onReconnectSucceeded = () => forceUpdate('onReconnectSucceeded');

    sdk.addConnectionHandler(KEY, handler);
    return () => sdk.removeConnectionHandler(KEY);
  }, [sdk]);

  useEffect(() => {
    const subscribe = AppState.addEventListener('change', state => {
      if (sdk.currentUser) {
        if (state === 'active') sdk.setForegroundState();
        if (state === 'background') sdk.setBackgroundState();
      }
    });

    return () => subscribe.remove();
  }, [sdk]);

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: CONNECTION_STATE_HEIGHT + top,
        paddingTop: top,
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
      }}>
      <Text caption3 color={colors.onBackgroundReverse01}>
        {`Connection: ${sdk.getConnectionState()} / ${text}`}
      </Text>
    </View>
  );
};
export default ConnectionStateView;
