package com.example.postlyforyakovlev;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

public class RegistrationFragment extends Fragment {

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