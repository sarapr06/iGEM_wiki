import React from "react"
import WikiLayout from "../components/layout.js"
import { HomeScrollPrototype } from "../components/HomeScrollPrototype.js"

const HomePage = () => (
  <WikiLayout fullBleed hideTopBar hideLoader>
    <HomeScrollPrototype />
  </WikiLayout>
)

export default HomePage

export const Head = () => <title>Home — iGEM Toronto 2026</title>
