import React, {createContext, useContext, useEffect, useState} from 'react';
import SendbirdChat, {SendBirdInstance, User} from 'sendbird';
import {AsyncStorageStatic} from '@react-native-async-storage/async-storage/lib/typescript/types';
import NetInfo from '@react-native-community/netinfo';

interface Root {
  sdk: SendBirdInstance;
  user: User | null;
  setUser: (user: User | null) => void;
}

type Props = React.PropsWithChildren<{
  appId: string;
  localCacheStorage?: AsyncStorageStatic;
}>;

export const RootContext = createContext<Root | null>(null);

export const RootContextProvider = ({children, appId, localCacheStorage}: Props) => {
  const initSDK = () => {
    const sdk = new SendbirdChat({appId, localCacheEnabled: Boolean(localCacheStorage)});

    sdk.setOnlineListener(onOnline => {
      return NetInfo.addEventListener(state => {
        const isOnline = Boolean(state.isConnected || state.isInternetReachable);
        if (isOnline) onOnline();
      });
    });

    sdk.setOfflineListener(onOffline => {
      return NetInfo.addEventListener(state => {
        const isOnline = Boolean(state.isConnected || state.isInternetReachable);
        if (!isOnline) onOffline();
      });
    });

    sdk.useAsyncStorageAsDatabase(localCacheStorage as any);
    return sdk;
  };

  const [sdk, setSdk] = useState(initSDK);
  const [user, setUser] = useState<Root['user']>(null);

  useEffect(() => {
    if (sdk.getApplicationId() !== appId) {
      setSdk(initSDK);
      setUser(null);
    }
  }, [appId]);

  return <RootContext.Provider value={{sdk, user, setUser}}>{children}</RootContext.Provider>;
};

export const useRootContext = () => {
  const context = useContext(RootContext);
  if (!context) throw new Error('Not provided RootContext');
  return context;
};
