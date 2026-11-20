package com.example.postlyforyakovlev.ui.chatlist;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;

import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.data.dto.chat.ChatItem;

import java.util.Objects;

public class ChatAdapter extends ListAdapter<ChatItem, ChatAdapter.ChatViewHolder> {

    public interface OnChatClickListener {
        void onChatClick(ChatItem chat);
    }

    private final OnChatClickListener listener;
    private static final DiffUtil.ItemCallback<ChatItem> DIFF_CALLBACK =
            new DiffUtil.ItemCallback<ChatItem>() {
                @Override
                public boolean areItemsTheSame(@NonNull ChatItem oldItem, @NonNull ChatItem newItem) {
                    return Objects.equals(oldItem.getId(), newItem.getId());
                }

                @Override
                public boolean areContentsTheSame(@NonNull ChatItem oldItem, @NonNull ChatItem newItem) {
                    return Objects.equals(oldItem.getName(), newItem.getName()) &&
                            Objects.equals(oldItem.getLastMessage(), newItem.getLastMessage());
                }
            };

    public ChatAdapter(OnChatClickListener listener){
        super(DIFF_CALLBACK);
        this.listener = listener;
    }

    @NonNull
    @Override
    public ChatViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_chat,parent,false);
        return new ChatViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ChatViewHolder holder, int position) {
        holder.bind(getItem(position), listener);
    }



    static class ChatViewHolder extends RecyclerView.ViewHolder{
        private final TextView chatName;
        private final TextView lastMessage;

        ChatViewHolder(@NonNull View itemView){
            super(itemView);
            chatName = itemView.findViewById(R.id.chatName);
            lastMessage = itemView.findViewById(R.id.lastMessage);
        }

        void bind(ChatItem chat, OnChatClickListener listener){
            chatName.setText(chat.getName());
            lastMessage.setText(chat.getLastMessage());

            itemView.setOnClickListener(v -> listener.onChatClick(chat));
        }
    }
}
