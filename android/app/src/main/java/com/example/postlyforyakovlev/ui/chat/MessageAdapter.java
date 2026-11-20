package com.example.postlyforyakovlev.ui.chat;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;

import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.data.dto.messages.MessageItem;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Objects;

public class MessageAdapter extends ListAdapter<MessageItem, MessageAdapter.MessageViewHolder> {
    private static final int TYPE_IN = 0;
    private static final int TYPE_OUT = 1;

    private final String myUserId;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());

    public MessageAdapter(String myUserId) {
        super(DIFF_CALLBACK);
        this.myUserId = myUserId;
    }

    private static final DiffUtil.ItemCallback<MessageItem> DIFF_CALLBACK =
            new DiffUtil.ItemCallback<MessageItem>() {
                @Override
                public boolean areItemsTheSame(@NonNull MessageItem a, @NonNull MessageItem b) {
                    return Objects.equals(a.getId(), b.getId());
                }

                @Override
                public boolean areContentsTheSame(@NonNull MessageItem a, @NonNull MessageItem b) {
                    return Objects.equals(a.getText(), b.getText())
                            && Objects.equals(a.getFileName(), b.getFileName())
                            && a.getCreatedAt() == b.getCreatedAt();
                }
            };

    @Override
    public int getItemViewType(int position) {
        return Objects.equals(getItem(position).getSenderId(), myUserId) ? TYPE_OUT : TYPE_IN;
    }

    @NonNull
    @Override
    public MessageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        int layout = viewType == TYPE_OUT ? R.layout.item_message_out : R.layout.item_message_in;
        View v = LayoutInflater.from(parent.getContext()).inflate(layout, parent, false);
        return new MessageViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull MessageViewHolder holder, int position) {
        MessageItem m = getItem(position);
        String text = m.getText();
        if (m.isFile()) {
            String name = m.getFileName() == null || m.getFileName().isEmpty()
                    ? "файл" : m.getFileName();
            text = "📎 " + name;
        }
        holder.text.setText(text);
        holder.time.setText(timeFormat.format(new Date(m.getCreatedAt())));
    }

    static class MessageViewHolder extends RecyclerView.ViewHolder {
        final TextView text;
        final TextView time;

        MessageViewHolder(@NonNull View itemView) {
            super(itemView);
            text = itemView.findViewById(R.id.messageText);
            time = itemView.findViewById(R.id.messageTime);
        }
    }
}