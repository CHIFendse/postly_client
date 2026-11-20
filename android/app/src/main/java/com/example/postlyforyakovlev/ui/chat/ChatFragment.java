package com.example.postlyforyakovlev.ui.chat;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.data.local.SessionManager;

public class ChatFragment extends Fragment {
    private static final String ARG_CHAT_ID = "chat_id";
    private static final String ARG_CHAT_NAME = "chat_name";

    public static ChatFragment newInstance(String chatId, String chatName) {
        ChatFragment f = new ChatFragment();
        Bundle args = new Bundle();
        args.putString(ARG_CHAT_ID, chatId);
        args.putString(ARG_CHAT_NAME, chatName);
        f.setArguments(args);
        return f;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_chat, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        String chatId = requireArguments().getString(ARG_CHAT_ID);
        String chatName = requireArguments().getString(ARG_CHAT_NAME);

        ((TextView) view.findViewById(R.id.chatTitle)).setText(chatName);
        ProgressBar progress = view.findViewById(R.id.chatProgress);
        TextView empty = view.findViewById(R.id.chatEmpty);
        RecyclerView recycler = view.findViewById(R.id.messagesRecycler);

        String myId = new SessionManager(requireContext()).getUserId();
        MessageAdapter adapter = new MessageAdapter(myId);

        LinearLayoutManager lm = new LinearLayoutManager(requireContext());
        lm.setReverseLayout(true);
        recycler.setLayoutManager(lm);
        recycler.setAdapter(adapter);

        MessageViewModel vm = new ViewModelProvider(this).get(MessageViewModel.class);

        recycler.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView rv, int dx, int dy) {
                int last = lm.findLastVisibleItemPosition();
                if (last != RecyclerView.NO_POSITION && last >= adapter.getItemCount() - 5) {
                    vm.loadMore();
                }
            }
        });

        vm.getMessages().observe(getViewLifecycleOwner(), list -> {
            adapter.submitList(list);
            empty.setVisibility(list == null || list.isEmpty() ? View.VISIBLE : View.GONE);
        });
        vm.getLoading().observe(getViewLifecycleOwner(), isLoading ->
                progress.setVisibility(Boolean.TRUE.equals(isLoading) ? View.VISIBLE : View.GONE));
        vm.getError().observe(getViewLifecycleOwner(), msg -> {
            if (msg != null) Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show();
        });

        vm.load(chatId);
    }
}