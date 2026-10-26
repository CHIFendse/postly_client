package com.example.postlyforyakovlev;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;

import com.example.postlyforyakovlev.fragments.ChatListFragment;
import com.example.postlyforyakovlev.fragments.LoginFragment;
import com.example.postlyforyakovlev.services.AuthCallback;
import com.example.postlyforyakovlev.services.AuthService;
import com.example.postlyforyakovlev.util.SessionManager;

public class MainActivity extends AppCompatActivity {
    private final AuthService authService = new AuthService();

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

        if (savedInstanceState == null) {
            SessionManager sessionManager = new SessionManager(this);
            if (sessionManager.hasToken()) {
                authService.verifyToken(sessionManager.getToken(), new AuthCallback<Boolean>() {
                    @Override
                    public void onSuccess(Boolean isValid) {
                        if (isFinishing() || isDestroyed()) return;
                        if (Boolean.TRUE.equals(isValid)) {
                            openRootFragment(new ChatListFragment());
                        } else {
                            sessionManager.clearSession();
                            openRootFragment(new LoginFragment());
                        }
                    }

                    @Override
                    public void onError(String errorMessage) {
                        if (isFinishing() || isDestroyed()) return;
                        // При временной ошибке сети пускаем в список чатов с сохраненной сессией
                        openRootFragment(new ChatListFragment());
                    }
                });
            } else {
                openRootFragment(new LoginFragment());
            }
        }
    }

    private void openRootFragment(Fragment fragment) {
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.fragment_container, fragment)
                .commit();
    }
}