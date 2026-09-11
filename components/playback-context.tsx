"use client";
import {createContext,useContext} from "react";
export const PlaybackContext=createContext<{suspended:boolean;register:(stop:()=>void)=>()=>void}>({suspended:false,register:()=>()=>{}});
export const useBackgroundPlayback=()=>useContext(PlaybackContext);
