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
import com.google.android.material.textfield.TextInputEditText;


public class LoginFragment extends Fragment {
    private final AuthService authService = new AuthService();

    public LoginFragment(){
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_login, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        TextView textView = view.findViewById(R.id.login_text_register);
        Button loginButton = view.findViewById(R.id.login_button_login);


        loginButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                TextInputEditText username = view.findViewById(R.id.login_input_username);
                TextInputEditText password = view.findViewById(R.id.login_input_password);

                authService.sendLoginRequest(username.getText().toString(), password.getText().toString(), new AuthCallback() {
                    @Override
                    public void onSuccess(String result) {
                        Toast.makeText(requireContext(), "Успешный вход!" + result, Toast.LENGTH_SHORT).show();
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
                        Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_SHORT).show();
                    }
                });
            }
        });

        if (textView!=null){
            textView.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    getParentFragmentManager().beginTransaction()
                            .setCustomAnimations(
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out,
                                    android.R.anim.fade_in,
                                    android.R.anim.fade_out
                            )
                            .replace(R.id.fragment_container, new RegistrationFragment())
                            .addToBackStack(null)
                            .commit();
                }
            });
        }
    }
}