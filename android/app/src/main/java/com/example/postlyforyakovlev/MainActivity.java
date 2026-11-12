package com.example.postlyforyakovlev;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.example.postlyforyakovlev.data.repository.AuthRepository;
import com.example.postlyforyakovlev.ui.chatlist.ChatListFragment;
import com.example.postlyforyakovlev.ui.auth.LoginFragment;
import com.example.postlyforyakovlev.ui.start.StartupViewModel;

public class MainActivity extends AppCompatActivity {
    private final AuthRepository authRepository = new AuthRepository(this);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        StartupViewModel vm = new ViewModelProvider(this).get(StartupViewModel.class);
        vm.getDestination().observe(this, dest -> {
            if (dest == StartupViewModel.Destination.LOADING) return;

            if (getSupportFragmentManager().findFragmentById(R.id.fragment_container) != null) return;

            openRootFragment(dest == StartupViewModel.Destination.CHAT_LIST
                    ? new ChatListFragment()
                    : new LoginFragment());
        });
    }

    private void openRootFragment(Fragment fragment) {
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.fragment_container, fragment)
                .commit();
    }
}