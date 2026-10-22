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

import com.example.postlyforyakovlev.services.AuthCallback;
import com.example.postlyforyakovlev.services.AuthService;
import com.example.postlyforyakovlev.R;
import com.example.postlyforyakovlev.dto.registration.RegistrationRequest;
import com.google.android.material.textfield.TextInputEditText;

public class RegistrationFragment extends Fragment {

    private final AuthService authService = new AuthService();

    public RegistrationFragment(){
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_registration, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        TextView textView = view.findViewById(R.id.registration_text_enter);
        Button registerButton = view.findViewById(R.id.registration_button);



        if (registerButton!=null){
            registerButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {

                    TextInputEditText username = view.findViewById(R.id.registration_input_username);
                    TextInputEditText password = view.findViewById(R.id.registration_input_password);
                    TextInputEditText email = view.findViewById(R.id.registration_input_email);
                    TextInputEditText phone = view.findViewById(R.id.registration_input_phone);

                    RegistrationRequest registrationRequest = new RegistrationRequest(
                            username.getText().toString(),
                            password.getText().toString(),
                            email.getText().toString(),
                            phone.getText().toString()
                    );

                    authService.sendRegistrationRequest(registrationRequest, new AuthCallback() {
                        @Override
                        public void onSuccess(String status) {
                            if (isAdded() && getContext() != null) {
                                Toast.makeText(requireContext(),"Вы успешно зарегистрировались, статус: " + status, Toast.LENGTH_LONG).show();
                            }
                            getParentFragmentManager().beginTransaction()
                                    .replace(R.id.fragment_container, new ChatListFragment())
                                    .setCustomAnimations(android.R.anim.fade_in,
                                            android.R.anim.fade_out,
                                            android.R.anim.fade_in,
                                            android.R.anim.fade_out)
                                    .commit();
                        }

                        @Override
                        public void onError(String errorMessage) {
                            if (isAdded() && getContext() != null) {
                                Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_LONG).show();
                            }
                        }
                    });
                }
            });
        }

        if (textView != null){
            textView.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    getParentFragmentManager().beginTransaction()
                            .replace(R.id.fragment_container, new LoginFragment())
                            .setCustomAnimations(
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out,
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out
                            )
                            .addToBackStack(null)
                            .commit();
                }
            });
        }
    }
}