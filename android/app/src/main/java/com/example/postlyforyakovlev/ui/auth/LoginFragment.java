package com.example.postlyforyakovlev.ui.auth;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.example.postlyforyakovlev.data.repository.AuthRepository;
import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.data.dto.login.LoginResponse;
import com.example.postlyforyakovlev.data.network.ApiCallback;
import com.example.postlyforyakovlev.data.local.SessionManager;
import com.example.postlyforyakovlev.ui.chatlist.ChatListFragment;
import com.google.android.material.textfield.TextInputEditText;

public class LoginFragment extends Fragment {
    private final AuthRepository authRepository = new AuthRepository(this.getContext());

    public LoginFragment() {
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_login, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        SessionManager sessionManager = new SessionManager(requireContext());
        TextView registerLink = view.findViewById(R.id.login_text_register);
        Button loginButton = view.findViewById(R.id.login_button_login);
        TextInputEditText usernameInput = view.findViewById(R.id.login_input_username);
        TextInputEditText passwordInput = view.findViewById(R.id.login_input_password);

        loginButton.setOnClickListener(v -> {
            String username = usernameInput.getText() != null ? usernameInput.getText().toString().trim() : "";
            String password = passwordInput.getText() != null ? passwordInput.getText().toString() : "";

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(requireContext(), "Введите логин и пароль", Toast.LENGTH_SHORT).show();
                return;
            }

            loginButton.setEnabled(false);

            authRepository.sendLoginRequest(username, password, new ApiCallback<LoginResponse>() {
                @Override
                public void onSuccess(LoginResponse result) {
                    if (!isAdded()) return;
                    loginButton.setEnabled(true);

                    String resolvedUsername = result.getUsername() != null ? result.getUsername() : username;
                    sessionManager.saveSession(result.getToken(), result.getId(), resolvedUsername);

                    Toast.makeText(requireContext(), "Добро пожаловать, " + resolvedUsername + "!", Toast.LENGTH_SHORT).show();
                    getParentFragmentManager().beginTransaction()
                            .setCustomAnimations(
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out,
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out
                            )
                            .replace(R.id.fragment_container, new ChatListFragment())
                            .commit();
                }

                @Override
                public void onError(String errorMessage) {
                    if (!isAdded()) return;
                    loginButton.setEnabled(true);
                    Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_SHORT).show();
                }
            });
        });

        if (registerLink != null) {
            registerLink.setOnClickListener(v -> getParentFragmentManager().beginTransaction()
                    .setCustomAnimations(
                            android.R.anim.fade_in,
                            android.R.anim.fade_out,
                            android.R.anim.fade_in,
                            android.R.anim.fade_out
                    )
                    .replace(R.id.fragment_container, new RegistrationFragment())
                    .addToBackStack(null)
                    .commit());
        }
    }
}