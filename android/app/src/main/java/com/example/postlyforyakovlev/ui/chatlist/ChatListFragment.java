package com.example.postlyforyakovlev.ui.chatlist;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.RecyclerView;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.ui.chat.ChatFragment;

public class ChatListFragment extends Fragment {

    public ChatListFragment() {
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_chat_list, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        RecyclerView recyclerView = view.findViewById(R.id.chatRecycler);
        ChatAdapter adapter = new ChatAdapter(chat -> {
            requireActivity().getSupportFragmentManager().beginTransaction()
                    .replace(R.id.fragment_container, ChatFragment.newInstance(chat.getId(), chat.getName()))
                    .addToBackStack(null)
                    .commit();
        });

        recyclerView.setAdapter(adapter);

        ChatListViewModel viewModel = new ViewModelProvider(this).get(ChatListViewModel.class);

        viewModel.getChats().observe(getViewLifecycleOwner(), adapter::submitList);

    }
}