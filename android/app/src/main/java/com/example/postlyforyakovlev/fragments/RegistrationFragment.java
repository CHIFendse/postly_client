package com.example.postlyforyakovlev.fragments;

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

import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.dto.registration.RegistrationRequest;
import com.example.postlyforyakovlev.dto.registration.RegistrationResponse;
import com.example.postlyforyakovlev.services.AuthCallback;
import com.example.postlyforyakovlev.services.AuthService;
import com.google.android.material.textfield.TextInputEditText;

public class RegistrationFragment extends Fragment {
    private final AuthService authService = new AuthService();

    public RegistrationFragment() {
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_registration, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        TextView enterLink = view.findViewById(R.id.registration_text_enter);
        Button registerButton = view.findViewById(R.id.registration_button);
        TextInputEditText usernameInput = view.findViewById(R.id.registration_input_username);
        TextInputEditText passwordInput = view.findViewById(R.id.registration_input_password);
        TextInputEditText emailInput = view.findViewById(R.id.registration_input_email);
        TextInputEditText phoneInput = view.findViewById(R.id.registration_input_phone);

        if (registerButton != null) {
            registerButton.setOnClickListener(v -> {
                String username = usernameInput.getText() != null ? usernameInput.getText().toString().trim() : "";
                String password = passwordInput.getText() != null ? passwordInput.getText().toString() : "";
                String email = emailInput.getText() != null ? emailInput.getText().toString().trim() : "";
                String phone = phoneInput.getText() != null ? phoneInput.getText().toString().trim() : "";

                if (username.isEmpty() || password.isEmpty() || email.isEmpty() || phone.isEmpty()) {
                    Toast.makeText(requireContext(), "Заполните все поля", Toast.LENGTH_SHORT).show();
                    return;
                }

                registerButton.setEnabled(false);

                RegistrationRequest registrationRequest = new RegistrationRequest(
                        username,
                        password,
                        email,
                        phone
                );

                authService.sendRegistrationRequest(registrationRequest, new AuthCallback<RegistrationResponse>() {
                    @Override
                    public void onSuccess(RegistrationResponse result) {
                        if (!isAdded()) return;
                        registerButton.setEnabled(true);
                        Toast.makeText(requireContext(), "Регистрация успешна! Войдите в аккаунт", Toast.LENGTH_SHORT).show();
                        getParentFragmentManager().popBackStack();
                    }

                    @Override
                    public void onError(String errorMessage) {
                        if (!isAdded()) return;
                        registerButton.setEnabled(true);
                        Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_SHORT).show();
                    }
                });
            });
        }

        if (enterLink != null) {
            enterLink.setOnClickListener(v -> getParentFragmentManager().popBackStack());
        }
    }
}