import {FlatList, KeyboardAvoidingView, LayoutAnimation, Platform, StyleSheet, TouchableOpacity, UIManager, View} from 'react-native';
import React, {useState} from 'react';
import {isMyMessage, useAsyncEffect, useForceUpdate} from '@sendbird/uikit-utils';
import {useRootContext} from '../contexts/RootContext';
import {BaseMessageInstance, FileMessage, GroupChannel, UserMessage} from 'sendbird';
import {useNavigation, useRoute} from '@react-navigation/native';
import AdminMessageView from '../components/AdminMessageView';
import FileMessageView from '../components/FileMessasgeView';
import UserMessageView from '../components/UserMessageView';
import {Icon, TextInput, useBottomSheet} from '@sendbird/uikit-react-native-foundation';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useHeaderHeight} from '@react-navigation/elements';
import * as ImagePicker from 'react-native-image-picker';
import {CONNECTION_STATE_HEIGHT} from '../components/ConnectionStateView';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const configureNext = () => {
  LayoutAnimation.configureNext({
    ...LayoutAnimation.Presets.easeInEaseOut,
    duration: 250,
  });
};

type SendableMessage = UserMessage | FileMessage;

const GroupChannelScreen = () => {
  const {sdk} = useRootContext();
  const navigation = useNavigation();
  const {params} = useRoute<{
    name: '';
    key: '';
    params: {channel: GroupChannel};
  }>();

  const forceUpdate = useForceUpdate();
  const [collection] = useState(() => {
    const channel = params.channel;
    return channel.createMessageCollection().build();
  });

  const [messages, setMessages] = useState<Record<string, SendableMessage>>({});

  const upsertMessages = (_messages: BaseMessageInstance[]) => {
    setMessages(({...draft}) => {
      _messages.forEach(message => {
        if (message.messageId) {
          // @ts-ignore
          if (draft[message.reqId]) delete draft[message.reqId];
          // @ts-ignore
          draft[message.messageId] = message;
        } else {
          // @ts-ignore
          draft[message.reqId] = message;
        }
      });

      return draft;
    });
    params.channel.markAsRead().then().catch();
  };

  const deleteMesssages = (_messageIds: number[]) => {
    configureNext();

    setMessages(({...draft}) => {
      _messageIds.forEach(id => {
        delete draft[id];
      });

      return draft;
    });
  };

  useAsyncEffect(async () => {
    params.channel.markAsRead().then().catch();

    collection
      .initialize(sdk.MessageCollection.MessageCollectionInitPolicy.CACHE_AND_REPLACE_BY_API)
      .onCacheResult((err, msgs) => {
        if (msgs.length) upsertMessages(msgs);
      })
      .onApiResult((err, msgs) => {
        if (msgs.length) upsertMessages(msgs);
      });

    collection.setMessageCollectionHandler({
      onChannelDeleted() {
        navigation.goBack();
      },
      onChannelUpdated() {
        forceUpdate();
      },
      onMessagesUpdated(_, __, msgs) {
        upsertMessages(msgs);
      },
      onMessagesAdded(_, __, msgs) {
        upsertMessages(msgs);
      },
      onMessagesDeleted(_, __, msgIds) {
        deleteMesssages(msgIds.map(x => x.messageId));
      },
      onHugeGapDetected() {
        // reset
      },
    });

    upsertMessages(await collection.loadPrevious());
    return () => collection.dispose();
  }, []);

  return (
    <>
      <FlatList
        inverted
        data={Object.values(messages).sort((a, b) => b.createdAt - a.createdAt)}
        contentContainerStyle={{padding: 12}}
        ItemSeparatorComponent={() => <View style={{height: 12}} />}
        keyExtractor={item => `${item.messageId || item.reqId}`}
        onEndReached={async () => {
          if (collection.hasPrevious) {
            upsertMessages(await collection.loadPrevious());
          }
        }}
        renderItem={({item}) => (
          <View style={{alignSelf: getItemAlign(item, sdk.currentUser.userId)}}>
            {item.isAdminMessage() && <AdminMessageView message={item} />}
            {item.isFileMessage() && <FileMessageView message={item} />}
            {item.isUserMessage() && <UserMessageView message={item} />}
          </View>
        )}
      />
      <SendInput channel={params.channel} />
    </>
  );
};

const SendInput = ({channel}: {channel: GroupChannel}) => {
  const height = useHeaderHeight();
  const {bottom} = useSafeAreaInsets();
  const {openSheet} = useBottomSheet();

  const {sdk} = useRootContext();

  const [text, setText] = useState('');

  const openAttachmentsSheet = async () => {
    openSheet({
      sheetItems: [
        {
          title: 'Open camera',
          icon: 'camera',
          onPress: async () => {
            const file = await ImagePicker.launchCamera({
              mediaType: 'mixed',
            });
            console.log(file.errorMessage);
            if (file.didCancel || file.errorCode === 'camera_unavailable') {
              return;
            }
            const asset = file.assets?.[0];
            if (asset) {
              const params = new sdk.FileMessageParams();
              params.file = {uri: asset.uri, name: asset.fileName, type: asset.type};
              channel.sendFileMessage(params, () => {});
            }
          },
        },
        {
          title: 'Open gallery',
          icon: 'photo',
          onPress: async () => {
            const file = await ImagePicker.launchImageLibrary({
              selectionLimit: 1,
              mediaType: 'mixed',
            });
            console.log(file.errorMessage);
            if (file.didCancel) return;

            const asset = file.assets?.[0];
            if (asset) {
              const params = new sdk.FileMessageParams();
              params.file = {uri: asset.uri, name: asset.fileName, type: asset.type};
              channel.sendFileMessage(params, () => {});
            }
          },
        },
      ],
    });
  };

  return (
    <KeyboardAvoidingView
      keyboardVerticalOffset={-bottom + height + CONNECTION_STATE_HEIGHT}
      behavior={Platform.select({
        ios: 'padding' as const,
        default: undefined,
      })}>
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={openAttachmentsSheet} style={{marginRight: 8}}>
          <Icon icon={'add'} size={20} />
        </TouchableOpacity>
        <TextInput multiline placeholder={'Enter message'} value={text} onChangeText={setText} style={styles.input} />
        {text.length > 0 && (
          <TouchableOpacity
            style={{marginLeft: 8}}
            onPress={() => {
              setText('');
              const params = new sdk.UserMessageParams();
              params.message = text;
              channel.sendUserMessage(params, () => {});
            }}>
            <Icon icon={'send'} size={20} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{height: bottom}} />
    </KeyboardAvoidingView>
  );
};

const getItemAlign = (message: BaseMessageInstance, currentUserId: string) => {
  if (message.isAdminMessage()) return 'center';
  if (message.isUserMessage() || message.isFileMessage()) {
    if (isMyMessage(message, currentUserId)) return 'flex-end';
    else return 'flex-start';
  }

  return 'center';
};

const styles = StyleSheet.create({
  inputContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 80,
    borderRadius: 4,
  },
});

export default GroupChannelScreen;
